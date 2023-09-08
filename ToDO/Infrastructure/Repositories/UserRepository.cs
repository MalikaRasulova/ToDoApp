using Microsoft.EntityFrameworkCore;
using ToDO.Domain;

namespace ToDO.Infrastructure.Repositories;

public class UserRepository : BaseRepository<User>
{
    public UserRepository(DataContext.DataContext context) : base(context)
    {
    }
}