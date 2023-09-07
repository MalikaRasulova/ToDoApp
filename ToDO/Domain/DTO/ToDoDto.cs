namespace ToDO.Domain.DTO;

public class ToDoDto
{
    public string Title { get; set; }
    public string Description { get; set; }
    
    public TimeDto ExecutionTime { get; set; }
}