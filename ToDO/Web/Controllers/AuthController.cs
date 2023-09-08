using Microsoft.AspNetCore.Mvc;
using ToDO.Domain;
using ToDO.Domain.DTO;
using ToDO.Infrastructure.Interfaces;

namespace ToDO.Web.Controllers;
[Controller, Route("user/")]
public class AuthController: ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpGet ("registration")]
    public async Task Registrotion([FromBody]UserRegistrationDto userRegistrationDto)
    {
        await _authService.RegisterUserAsync(userRegistrationDto);
    }

    [HttpGet("login")]
    public async Task<Client> Login([FromBody] UserLoginDto userLoginDto)
    {
        return await _authService.Login(userLoginDto);
    }

    [HttpGet("{id:guid}")]
    public async Task LogOut(Guid id)
    {
        await _authService.Logout(id);
    }


}