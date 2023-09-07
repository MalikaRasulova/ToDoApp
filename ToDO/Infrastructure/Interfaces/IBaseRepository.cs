using ToDO.Domain;

namespace ToDO.Infrastructure.Interfaces;

public interface IBaseRepository<T> where T : BaseModel
{
    IQueryable<T> GetAll();

    Task<T?> GetByIdAsync(Guid id);
    
    Task<T> AddAsync(T entity);
    
    Task<T> UpdateAsync(T entity);
    
    Task<T> RemoveAsync(T entity);
    
    Task<T> RemoveAsync(Guid id);
    
}