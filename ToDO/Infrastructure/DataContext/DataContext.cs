using Microsoft.EntityFrameworkCore;
using ToDO.Configurations;
using ToDO.Domain;

namespace ToDO.Infrastructure.DataContext;

public class DataContext: DbContext
{
    public DbSet<User> Users { get; set; }
    public DbSet<Client> Clients { get; set; }
    public DbSet<ToDo> ToDos { get; set; }

    public DataContext()
    {
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
    }

    public DataContext(DbContextOptions dbContextOptions): base(dbContextOptions)
    {
        
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.
            UseLazyLoadingProxies();
        optionsBuilder.UseNpgsql(Settings.dbConnectionString);
        base.OnConfiguring(optionsBuilder);
        
        //var connectionString = "connstr";
        //optionsBuilder.UseSqlServer(connectionString,x=>x.UseNetTopologySuite());
        //ProxiesExtensions.UseChangeTrackingProxies(optionsBuilder);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("ToDo");

        modelBuilder
            .Entity<User>()
            .HasIndex(x => x.PhoneNumber)
            .IsUnique();

        modelBuilder
            .Entity<ToDo>()
            .HasOne(x => x.Owner)
            .WithMany(x => x.ToDos)
            .HasForeignKey(x => x.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder
            .Entity<Client>()
            .HasOne(x => x.User)
            .WithOne(x => x.Client)
            .HasForeignKey<Client>(x => x.UserId);
        
        modelBuilder
            .Entity<User>()
            .HasIndex(x => x.Id);
        
        modelBuilder
            .Entity<ToDo>()
            .HasIndex(x => x.Id);
        
        modelBuilder
            .Entity<Client>()
            .HasIndex(x => x.Id);


    }
}