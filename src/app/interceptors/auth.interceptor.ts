import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, from, switchMap } from 'rxjs';
import { getStoredTokens, clearTokens, isTokenValid, storeTokens } from '../utils/token.utils';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Пропускаем запросы аутентификации
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const tokens = getStoredTokens();
  
  // Если нет токенов - редирект
  if (!tokens) {
    clearTokens();
    router.navigate(['/login']);
    return throwError(() => new Error('Не аутентифицирован'));
  }

  // Если токен валиден - добавляем в заголовки
  if (isTokenValid(tokens)) {
    const modifiedReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${tokens.accessToken}`)
    });
    return next(modifiedReq);
  }

  // Если есть refresh token - пытаемся обновить
  if (tokens.refreshToken) {
    return refreshTokenRequest(tokens.refreshToken).pipe(
      switchMap((response: any) => {
        if (response?.accessToken) {
          const expiresAt = Date.now() + (1 * 60 * 1000);
          const newTokens = {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt
          };
          storeTokens(newTokens);

          const newReq = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${response.accessToken}`)
          });
          return next(newReq);
        }
        throw new Error('Не удалось обновить токен');
      }),
      catchError((error) => {
        clearTokens();
        router.navigate(['/login'], {
          queryParams: { message: 'Сессия истекла. Войдите снова.' }
        });
        return throwError(() => error);
      })
    );
  }

  // Если дошли сюда - нет валидных токенов
  clearTokens();
  router.navigate(['/login']);
  return throwError(() => new Error('Не аутентифицирован'));
};

function refreshTokenRequest(refreshToken: string) {
  return from(
    fetch('https://dummyjson.com/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken })
    }).then(response => {
      if (!response.ok) {
        throw new Error('Refresh token failed');
      }
      return response.json();
    })
  );
}