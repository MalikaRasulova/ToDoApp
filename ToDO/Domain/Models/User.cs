using System.ComponentModel.DataAnnotations.Schema;

namespace ToDO.Domain;

[Table("users")]
public class User : BaseModel
{
    
    [Column ("name")]
    public string Name { get; set; }
    
    [Column ("phone_number")] 
    public string PhoneNumber { get; set; }
    
    [Column ("password")]
    public string  Password { get; set; }

    [Column ("client_id")]
    public Guid ClientId { get; set; }
    
    [NotMapped] 
    public virtual Client Client { get; set; }
    
    [Column("signed")]
    public bool Signed { get; set; }
    
    [Column("last_login_date")]
    public DateTime LastLoginDate { get; set; }
}