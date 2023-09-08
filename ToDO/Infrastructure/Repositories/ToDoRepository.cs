using Microsoft.EntityFrameworkCore;
using ToDO.Domain;

namespace ToDO.Infrastructure.Repositories;

public class ToDoRepository : BaseRepository<ToDo>
{
    public ToDoRepository(DataContext.DataContext context) : base(context)
    {
    }
}