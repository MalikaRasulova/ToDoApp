using Microsoft.EntityFrameworkCore;
using ToDO.Domain;
using ToDO.Domain.DTO;
using ToDO.Infrastructure.Interfaces;
using ToDO.Infrastructure.Repositories;

namespace ToDO.Infrastructure.Services;

public class AuthService: IAuthService
{
    private  UserRepository _userRepository;
    private  ClientRepository _clientRepository;

    public AuthService(UserRepository userRepository, ClientRepository clientRepository)
    {
        _userRepository = userRepository;
        _clientRepository = clientRepository;
    }
    public async Task RegisterUserAsync(UserRegistrationDto userDto)
    {
        var oldUser = await this._userRepository.GetAll()
            .FirstOrDefaultAsync(x => x.PhoneNumber == userDto.PhoneNumber);
        if (oldUser is User)
            throw new Exception("User Already exsists");

        var insertedUser = await this._userRepository.AddAsync(
            new User()
            {
                PhoneNumber = userDto.PhoneNumber,
                Password = userDto.Password,
                Name = userDto.Name

            });
        if (insertedUser is null)
            throw new Exception("Unable to insert user");

        var client = new Client()
        {
            UserId = insertedUser.Id,
            User = insertedUser,
            Password = insertedUser.Password,
            Name = insertedUser.Name,
            PhoneNumber = insertedUser.PhoneNumber
        };
        var insertedClient = await this._clientRepository
            .AddAsync(client);

        if (insertedClient is null)
            throw new Exception("Unable to add client");

    }

    public async Task<Client?> Login(UserRegistrationDto entity)
    {
        var userInfo = await _userRepository.GetAll()
            .FirstOrDefaultAsync(x =>
                x.PhoneNumber == entity.PhoneNumber
                && x.Password == entity.Password);

        if (userInfo is User)
        {
            userInfo.Signed = true;
            userInfo.LastLoginDate = DateTime.Now;

            await _userRepository.UpdateAsync(userInfo);

            return userInfo.Client;
        }

        return null;
    }

    public async Task Logout(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user is null)
            throw new Exception("user not found");

        user.Signed = false;
        await _userRepository.UpdateAsync(user);
    }
}