using ToDO.Domain;
using ToDO.Domain.DTO;

namespace ToDO.Infrastructure.Interfaces;

public interface IAuthService
{
    Task RegisterUserAsync(UserRegistrationDto userDto);

    Task<Client?> Login(UserLoginDto userLoginDto);

    public  Task Logout(Guid userId);

}