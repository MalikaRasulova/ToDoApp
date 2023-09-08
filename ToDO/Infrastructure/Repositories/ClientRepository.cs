using Microsoft.EntityFrameworkCore;
using ToDO.Domain;

namespace ToDO.Infrastructure.Repositories;

public class ClientRepository: BaseRepository<Client>
{
    public ClientRepository(DataContext.DataContext context) : base(context)
    {
        
    }
}