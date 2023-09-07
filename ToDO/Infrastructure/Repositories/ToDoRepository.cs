using Microsoft.EntityFrameworkCore;
using ToDO.Domain;

namespace ToDO.Infrastructure.Repositories;

public class ToDoRepository : BaseRepository<ToDo>
{
    public ToDoRepository(DbContext context) : base(context)
    {
    }
}