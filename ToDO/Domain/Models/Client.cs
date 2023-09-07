using System.ComponentModel.DataAnnotations.Schema;

namespace ToDO.Domain;

[Table("clients")]
public class Client : BaseModel
{

    [Column ("name")]
    public string Name { get; set; }
    
    [Column ("phone_number")] 
    public string PhoneNumber { get; set; }
    
    [Column ("password")]
    public string  Password { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [NotMapped]
    public virtual User User { get; set; }

    [NotMapped] public virtual List<ToDo> ToDos { get; set; } = new List<ToDo>();

}