import Resolver from '@forge/resolver';
import api, { asApp, route } from '@forge/api';
import pkg from 'pg';

const { Pool } = pkg;

// Read connection details from environment variables
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
const POSTGRES_SSL = String(process.env.POSTGRES_SSL || 'true').toLowerCase() !== 'false';

if (!DATABASE_URL) {
  // Fail fast; surface clear error in logs
  console.warn('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING not set. Set it via Forge variables.');
}

let poolSingleton;
function getPool() {
  if (!poolSingleton) {
    poolSingleton = new Pool({
      connectionString: DATABASE_URL,
      ssl: POSTGRES_SSL ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PG_POOL_MAX || 5)
    });
  }
  return poolSingleton;
}

async function ensureSchema(client) {
  // Minimal schema for projects, issues, and issue links
  await client.query(`
    CREATE TABLE IF NOT EXISTS jira_projects (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      project_type TEXT,
      lead_account_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS jira_issues (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      project_id TEXT NOT NULL,
      summary TEXT,
      status TEXT,
      issue_type TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      FOREIGN KEY (project_id) REFERENCES jira_projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS jira_issue_links (
      link_id TEXT PRIMARY KEY,
      type_name TEXT,
      inward_description TEXT,
      outward_description TEXT,
      source_issue_id TEXT NOT NULL,
      target_issue_id TEXT NOT NULL
    );
  `);
}

async function fetchAllProjects() {
  const results = [];
  let startAt = 0;
  const maxResults = 50;

  while (true) {
    const res = await asApp().requestJira(route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira project search failed ${res.status}: ${text}`);
    }
    const data = await res.json();
    const values = data.values || [];
    results.push(...values);
    if (data.isLast || values.length === 0) break;
    startAt += values.length;
  }

  return results.map(p => ({
    id: String(p.id),
    key: p.key,
    name: p.name,
    projectType: p.projectTypeKey || p.projectType || null,
    leadAccountId: p.lead && p.lead.accountId ? p.lead.accountId : null
  }));
}

async function fetchAllIssues(fields = [
  'summary','status','issuetype','project','created','updated','issuelinks'
]) {
  const results = [];
  let startAt = 0;
  const maxResults = 100; // Jira max is 100
  const jql = '* order by id asc';
  const fieldsParam = fields.join(',');

  while (true) {
    const res = await asApp().requestJira(
      route`/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=${fieldsParam}`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira issue search failed ${res.status}: ${text}`);
    }
    const data = await res.json();
    const issues = data.issues || [];
    results.push(...issues);
    if (issues.length < maxResults) break;
    startAt += issues.length;
  }

  return results;
}

async function upsertProjects(client, projects) {
  if (projects.length === 0) return 0;
  await client.query('BEGIN');
  try {
    for (const p of projects) {
      await client.query(
        `INSERT INTO jira_projects (id, key, name, project_type, lead_account_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (id) DO UPDATE SET
           key = EXCLUDED.key,
           name = EXCLUDED.name,
           project_type = EXCLUDED.project_type,
           lead_account_id = EXCLUDED.lead_account_id,
           updated_at = NOW()`,
        [p.id, p.key, p.name, p.projectType, p.leadAccountId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return projects.length;
}

function mapIssue(issue) {
  const fields = issue.fields || {};
  return {
    id: String(issue.id),
    key: issue.key,
    projectId: fields.project ? String(fields.project.id) : null,
    summary: fields.summary || null,
    status: fields.status ? fields.status.name : null,
    issueType: fields.issuetype ? fields.issuetype.name : null,
    createdAt: fields.created ? new Date(fields.created) : null,
    updatedAt: fields.updated ? new Date(fields.updated) : null,
    links: Array.isArray(fields.issuelinks) ? fields.issuelinks : []
  };
}

async function upsertIssues(client, issues) {
  if (issues.length === 0) return 0;
  await client.query('BEGIN');
  try {
    for (const i of issues) {
      await client.query(
        `INSERT INTO jira_issues (id, key, project_id, summary, status, issue_type, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           key = EXCLUDED.key,
           project_id = EXCLUDED.project_id,
           summary = EXCLUDED.summary,
           status = EXCLUDED.status,
           issue_type = EXCLUDED.issue_type,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
        [i.id, i.key, i.projectId, i.summary, i.status, i.issueType, i.createdAt, i.updatedAt]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return issues.length;
}

function extractIssueLinks(mappedIssues) {
  const links = [];
  for (const mi of mappedIssues) {
    for (const link of mi.links) {
      const linkId = String(link.id || `${mi.id}-${link.type?.name}-${link.inwardIssue?.id || link.outwardIssue?.id || ''}`);
      // Two possible shapes: inwardIssue or outwardIssue
      if (link.inwardIssue) {
        links.push({
          linkId,
          typeName: link.type?.name || null,
          inwardDescription: link.type?.inward || null,
          outwardDescription: link.type?.outward || null,
          sourceIssueId: String(link.inwardIssue.id),
          targetIssueId: mi.id
        });
      }
      if (link.outwardIssue) {
        links.push({
          linkId,
          typeName: link.type?.name || null,
          inwardDescription: link.type?.inward || null,
          outwardDescription: link.type?.outward || null,
          sourceIssueId: mi.id,
          targetIssueId: String(link.outwardIssue.id)
        });
      }
    }
  }
  return links;
}

async function upsertIssueLinks(client, links) {
  if (links.length === 0) return 0;
  await client.query('BEGIN');
  try {
    for (const l of links) {
      await client.query(
        `INSERT INTO jira_issue_links (link_id, type_name, inward_description, outward_description, source_issue_id, target_issue_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (link_id) DO UPDATE SET
           type_name = EXCLUDED.type_name,
           inward_description = EXCLUDED.inward_description,
           outward_description = EXCLUDED.outward_description,
           source_issue_id = EXCLUDED.source_issue_id,
           target_issue_id = EXCLUDED.target_issue_id`,
        [l.linkId, l.typeName, l.inwardDescription, l.outwardDescription, l.sourceIssueId, l.targetIssueId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return links.length;
}

const resolver = new Resolver();

resolver.define('sync.projects', async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING is not configured');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const projects = await fetchAllProjects();
    const count = await upsertProjects(client, projects);
    return { projects: count };
  } finally {
    client.release();
  }
});

resolver.define('sync.issues', async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING is not configured');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const jiraIssues = await fetchAllIssues();
    const mapped = jiraIssues.map(mapIssue);
    const count = await upsertIssues(client, mapped);
    return { issues: count };
  } finally {
    client.release();
  }
});

resolver.define('sync.relations', async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING is not configured');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    // Fetch only fields needed for relations to reduce payload
    const jiraIssues = await fetchAllIssues(['issuelinks']);
    const mapped = jiraIssues.map(mapIssue);
    const links = extractIssueLinks(mapped);
    const count = await upsertIssueLinks(client, links);
    return { links: count };
  } finally {
    client.release();
  }
});

resolver.define('sync.all', async () => {
  // Convenience endpoint to run full sync in order
  if (!DATABASE_URL) throw new Error('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING is not configured');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const projects = await fetchAllProjects();
    const projectsCount = await upsertProjects(client, projects);
    const jiraIssues = await fetchAllIssues();
    const mapped = jiraIssues.map(mapIssue);
    const issuesCount = await upsertIssues(client, mapped);
    const links = extractIssueLinks(mapped);
    const linksCount = await upsertIssueLinks(client, links);
    return { projects: projectsCount, issues: issuesCount, links: linksCount };
  } finally {
    client.release();
  }
});

export const handler = resolver.getDefinitions();
