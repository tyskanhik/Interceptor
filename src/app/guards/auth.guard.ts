import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkAuth().pipe(
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      } else {
        router.navigate(['/login'], { 
          queryParams: { message: 'Пожалуйста, войдите в систему' } 
        });
        return false;
      }
    }),
    catchError(() => {
      router.navigate(['/login'], { 
        queryParams: { message: 'Ошибка проверки авторизации' } 
      });
      return of(false);
    })
  );
};