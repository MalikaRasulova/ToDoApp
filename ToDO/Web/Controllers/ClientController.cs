using Microsoft.AspNetCore.Mvc;
using ToDO.Domain;
using ToDO.Infrastructure.Interfaces;

namespace ToDO.Web.Controllers;
[Controller, Route(("client/"))]
public class ClientController : ControllerBase
{
    private readonly IClientService _clientService;

    public ClientController(IClientService clientService)
    {
        _clientService = clientService;
    }

    [HttpPut]
    public async Task Update()
    {
        
    }
}