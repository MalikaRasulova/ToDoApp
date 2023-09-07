using Microsoft.EntityFrameworkCore;
using ToDO.Domain;
using ToDO.Domain.DTO;
using ToDO.Domain.Enums;
using ToDO.Infrastructure.Repositories;

namespace ToDO.Infrastructure.Services;

public class ToDoService : IToDoService
{
    private  ToDoRepository _toDoRepository;
    private  ClientRepository _clientRepository;

    public ToDoService(ToDoRepository toDoRepository, ClientRepository clientRepository)
    {
        _toDoRepository = toDoRepository;
        _clientRepository = clientRepository;
    }
    
    public async Task<ToDo> CreateToDo(ToDoDto toDoDto, Guid ClientId)
    {
       var insertedToDo = new ToDo()
       {
           Description = toDoDto.Description,
           Title = toDoDto.Title,
           OwnerId = ClientId,
           Status = ToDoStatus.CREATED,
           ExecutionTime = new DateTime(toDoDto.ExecutionTime.Year,
               toDoDto.ExecutionTime.Month,
               toDoDto.ExecutionTime.Day,
               toDoDto.ExecutionTime.Hour,
               toDoDto.ExecutionTime.Min,
               toDoDto.ExecutionTime.Secund)
       };

       var toDo = await _toDoRepository.AddAsync(insertedToDo);

       if (toDo is null)
           throw new Exception("Uneble to add ToDo ");
       return toDo;
    }

  

    public async Task<List<ToDo>> GetAllToDoes(Guid ownerId)
    {
        var result = _toDoRepository.GetAll().Where(x => x.OwnerId == ownerId)
            .ToList();
            
        return result;
    }

    public async Task<ToDo> UpdateToDo(string prop, string word, Guid toDoId)
    {
        var todo = await _toDoRepository.GetByIdAsync(toDoId);
        if (todo is null)
            throw new Exception("data not found");
        switch (prop)
        {
            case "title":{ todo.Title = word; break;}
            case "description":{ todo.Description = word; break;}
        }

        var updateToDo = await _toDoRepository.UpdateAsync(todo);
        
        return updateToDo;
    }

    public Task<ToDo> UpdateToDoDescription(string description, Guid toDoId) =>
        (this.UpdateToDo("description", description, toDoId));

    public Task<ToDo> UpdateToDoTitle(string description, Guid toDoId) =>
        (this.UpdateToDo("title", description, toDoId));
    
    public async Task<ToDo> UpdateToDoStatus(string status, Guid toDoId)
    {
        var todo = await _toDoRepository.GetByIdAsync(toDoId);
        if (todo is null)
            throw new Exception("data not found");
        switch ("ToDoStatus."+status)
        {
            case nameof(ToDoStatus.CREATED): { todo.Status = ToDoStatus.CREATED; break;}
            case nameof(ToDoStatus.CENCELED): { todo.Status = ToDoStatus.CENCELED; break;}
            case nameof(ToDoStatus.FINISHED): { todo.Status = ToDoStatus.FINISHED; break;}
            case nameof(ToDoStatus.IN_PROGRES): { todo.Status = ToDoStatus.IN_PROGRES; break;}
        }

        var updateToDo = await _toDoRepository.UpdateAsync(todo);
        return updateToDo;
    }

    public async Task<ToDo> UpdateToDoTime(string time, Guid toDoId)
    {
        var todo = await _toDoRepository.GetByIdAsync(toDoId);
        if (todo is null)
            throw new Exception("data not found");
        todo.ExecutionTime = DateTime.Parse(time);
        var updateToDoTime = await _toDoRepository.UpdateAsync(todo);
        return updateToDoTime;
    }

    public Task<ToDo> FindById(Guid id)
    {
        return _toDoRepository.GetByIdAsync(id);
    }

    public Task<ToDo> Remove(Guid id)
    {
        return _toDoRepository.RemoveAsync(id);
    }
}