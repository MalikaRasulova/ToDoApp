using System.ComponentModel.DataAnnotations.Schema;
using ToDO.Domain.Enums;

namespace ToDO.Domain;

[Table("todos")]
public class ToDo : BaseModel
{
    
    
    [Column("owner_id")]
    public Guid OwnerId { get; set; }

    [NotMapped]
    public virtual Client Owner { get; set; }
    
    [Column("title")]
    public string? Title{ get; set; }
    
    [Column("description")]
    public string? Description { get; set; }

    [Column("execution_time")]
    public DateTime ExecutionTime { get; set; }

    [Column("status")]
    public ToDoStatus Status { get; set; }
    
}