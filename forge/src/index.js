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

    -- Worklogs for issues
    CREATE TABLE IF NOT EXISTS jira_worklogs (
      worklog_id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      author_account_id TEXT,
      author_display_name TEXT,
      time_spent_seconds INTEGER,
      started_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      visibility_type TEXT,
      visibility_value TEXT,
      comment TEXT,
      FOREIGN KEY (issue_id) REFERENCES jira_issues(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jira_worklogs_issue_id ON jira_worklogs(issue_id);
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

// Fetch only issue ids/keys to minimize payload
async function fetchAllIssueIds() {
  const results = [];
  let startAt = 0;
  const maxResults = 100; // Jira max is 100
  const jql = '* order by id asc';

  while (true) {
    const res = await asApp().requestJira(
      route`/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=*none`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira issue id search failed ${res.status}: ${text}`);
    }
    const data = await res.json();
    const issues = data.issues || [];
    results.push(...issues);
    if (issues.length < maxResults) break;
    startAt += issues.length;
  }

  return results.map(i => ({ id: String(i.id), key: i.key }));
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

// Helper to flatten ADF comment objects into plain text
function extractTextFromAdf(adfNode) {
  if (!adfNode) return null;
  // If already a string, return as-is
  if (typeof adfNode === 'string') return adfNode;
  try {
    const pieces = [];
    (function walk(node) {
      if (!node) return;
      if (typeof node === 'string') {
        pieces.push(node);
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node) walk(child);
        return;
      }
      if (node.text) pieces.push(node.text);
      if (node.content) walk(node.content);
      if (node.attrs && node.attrs.text) pieces.push(node.attrs.text);
      if (node.marks) walk(node.marks);
      if (node.children) walk(node.children);
    })(adfNode);
    const text = pieces.join(' ').replace(/\s+/g, ' ').trim();
    return text || null;
  } catch {
    return null;
  }
}

async function fetchIssueWorklogs(issueIdOrKey) {
  const all = [];
  let startAt = 0;
  const maxResults = 100; // practical page size
  while (true) {
    const res = await asApp().requestJira(
      route`/rest/api/3/issue/${issueIdOrKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira worklog fetch failed for ${issueIdOrKey} -> ${res.status}: ${text}`);
    }
    const data = await res.json();
    const values = data.worklogs || data.values || [];
    all.push(...values);
    const fetched = values.length;
    const total = typeof data.total === 'number' ? data.total : null;
    if (fetched < maxResults || (total !== null && all.length >= total)) break;
    startAt += fetched;
  }
  return all;
}

function mapWorklog(issueId, wl) {
  const visibility = wl.visibility || {};
  const commentText = wl.comment && typeof wl.comment === 'object' ? extractTextFromAdf(wl.comment) : (wl.comment || null);
  return {
    worklogId: String(wl.id),
    issueId: String(issueId),
    authorAccountId: wl.author?.accountId || null,
    authorDisplayName: wl.author?.displayName || null,
    timeSpentSeconds: typeof wl.timeSpentSeconds === 'number' ? wl.timeSpentSeconds : null,
    startedAt: wl.started ? new Date(wl.started) : null,
    updatedAt: wl.updated ? new Date(wl.updated) : null,
    visibilityType: visibility.type || null,
    visibilityValue: visibility.value || null,
    comment: commentText
  };
}

async function upsertWorklogs(client, worklogs) {
  if (worklogs.length === 0) return 0;
  await client.query('BEGIN');
  try {
    for (const w of worklogs) {
      await client.query(
        `INSERT INTO jira_worklogs (worklog_id, issue_id, author_account_id, author_display_name, time_spent_seconds, started_at, updated_at, visibility_type, visibility_value, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (worklog_id) DO UPDATE SET
           issue_id = EXCLUDED.issue_id,
           author_account_id = EXCLUDED.author_account_id,
           author_display_name = EXCLUDED.author_display_name,
           time_spent_seconds = EXCLUDED.time_spent_seconds,
           started_at = EXCLUDED.started_at,
           updated_at = EXCLUDED.updated_at,
           visibility_type = EXCLUDED.visibility_type,
           visibility_value = EXCLUDED.visibility_value,
           comment = EXCLUDED.comment`,
        [
          w.worklogId,
          w.issueId,
          w.authorAccountId,
          w.authorDisplayName,
          w.timeSpentSeconds,
          w.startedAt,
          w.updatedAt,
          w.visibilityType,
          w.visibilityValue,
          w.comment
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return worklogs.length;
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

resolver.define('sync.worklogs', async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING is not configured');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const issues = await fetchAllIssueIds();
    let total = 0;
    for (const issue of issues) {
      const wls = await fetchIssueWorklogs(issue.id);
      const mapped = wls.map(wl => mapWorklog(issue.id, wl));
      total += await upsertWorklogs(client, mapped);
    }
    return { worklogs: total };
  } finally {
    client.release();
  }
});

resolver.define('get.worklogs', async (req) => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL / POSTGRES_URL / PG_CONNECTION_STRING is not configured');
  const payload = req && req.payload ? req.payload : {};
  const issueId = payload.issueId || null;
  const issueKey = payload.issueKey || null;
  const limit = Math.min(Math.max(Number(payload.limit || 50), 1), 500);

  if (!issueId && !issueKey) {
    throw new Error('Provide issueId or issueKey');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    if (issueKey) {
      const { rows } = await client.query(
        `SELECT w.* FROM jira_worklogs w
         JOIN jira_issues i ON i.id = w.issue_id
         WHERE i.key = $1
         ORDER BY COALESCE(w.started_at, w.updated_at) DESC
         LIMIT ${limit}`,
        [issueKey]
      );
      return { worklogs: rows };
    } else {
      const { rows } = await client.query(
        `SELECT * FROM jira_worklogs
         WHERE issue_id = $1
         ORDER BY COALESCE(started_at, updated_at) DESC
         LIMIT ${limit}`,
        [issueId]
      );
      return { worklogs: rows };
    }
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
    // Fetch and upsert worklogs for all issues
    let worklogsCount = 0;
    for (const m of mapped) {
      const wls = await fetchIssueWorklogs(m.id);
      const wMapped = wls.map(wl => mapWorklog(m.id, wl));
      worklogsCount += await upsertWorklogs(client, wMapped);
    }
    return { projects: projectsCount, issues: issuesCount, links: linksCount, worklogs: worklogsCount };
  } finally {
    client.release();
  }
});

export const handler = resolver.getDefinitions();
