using Microsoft.EntityFrameworkCore;
using ToDO.Domain;

namespace ToDO.Infrastructure.Repositories;

public class UserRepository : BaseRepository<User>
{
    public UserRepository(DbContext context) : base(context)
    {
    }
}