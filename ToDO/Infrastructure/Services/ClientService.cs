using ToDO.Domain;
using ToDO.Infrastructure.Interfaces;
using ToDO.Infrastructure.Repositories;

namespace ToDO.Infrastructure.Services;

public class ClientService : IClientService
{
    private  ClientRepository _clientRepository;

    public ClientService(ClientRepository clientRepository)
    {
        _clientRepository = clientRepository;
    }
    public async Task<Client> UpdateClientUserName(Guid clientId, string newUsername)
    {
        var client = await _clientRepository.GetByIdAsync(clientId);
        if (client is null)
            throw new Exception("Client not found!");
        client.Name = newUsername;

        return await _clientRepository.UpdateAsync(client);
    }

    public async Task<Client> UpdateClientPhoneNumber(Guid clientId, string number)
    {
        var client = await _clientRepository.GetByIdAsync(clientId);
        if (client is null)
            throw new Exception("Client not found!");
        client.PhoneNumber = number ;

        return await _clientRepository.UpdateAsync(client);

    }
}