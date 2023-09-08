using Microsoft.EntityFrameworkCore;
using ToDO.Infrastructure.DataContext;
using ToDO.Infrastructure.Interfaces;
using ToDO.Infrastructure.Repositories;
using ToDO.Infrastructure.Services;

namespace ToDO.Extensions;

public static class ConfigureExtensions
{
    public static void ConfigureDbContexts(this IServiceCollection serviceCollection,
        ConfigurationManager configurationManager)
    {
        serviceCollection.AddDbContext<DataContext>(optionsBuilder =>
            optionsBuilder
                .UseNpgsql(configurationManager.GetConnectionString("DefaultConnectionString")));
    }

    public static void ConfigureRepositories(this IServiceCollection serviceCollection)
    {
        serviceCollection.AddScoped<IAuthService, AuthService>();
        serviceCollection.AddScoped<IClientService, ClientService>();
        serviceCollection.AddScoped<IToDoService, ToDoService>();
        serviceCollection.AddScoped<UserRepository>();
        serviceCollection.AddScoped<ClientRepository>();
        serviceCollection.AddScoped<ToDoRepository>();

    }
}