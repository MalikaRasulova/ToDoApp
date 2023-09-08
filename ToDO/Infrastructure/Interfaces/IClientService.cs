using ToDO.Domain;

namespace ToDO.Infrastructure.Interfaces;

public interface IClientService
{
    Task<Client> UpdateClientUserName(Guid clientId, string newUsername);
   
    Task<Client> UpdateClientPhoneNumber(Guid clientId, string number);

}