using ToDO.Domain;
using ToDO.Domain.DTO;

namespace ToDO.Infrastructure.Repositories;

public interface IToDoService
{
    Task<ToDo> CreateToDo(ToDoDto toDoDto, Guid ClientId);

    Task<List<ToDo>> GetAllToDoes(Guid ownerId);

    Task<ToDo> UpdateToDoTitle(string title, Guid toDoId);
   
    Task<ToDo> UpdateToDoDescription(string description, Guid toDoId);
   
    Task<ToDo> UpdateToDoStatus(string status, Guid toDoId);
  
    Task<ToDo> UpdateToDoTime(string time, Guid toDoId);

    Task<ToDo> FindById(Guid id);

    Task<ToDo> Remove(Guid id);
    
    
}