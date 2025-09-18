import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, tap, throwError, map, of, switchMap, filter, take } from 'rxjs';
import { AuthState, AuthTokens, LoginCredentials, User } from '../models/auth.model';
import { getStoredTokens, isTokenValid, storeTokens, clearTokens, getTimeUntilExpiry, getTokenExpiryTime } from '../utils/token.utils';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = 'https://dummyjson.com/auth';
  private readonly ACCESS_TOKEN_EXPIRY = 1 * 60 * 1000; // 1 минута

  private http = inject(HttpClient);
  private router = inject(Router);

  private isRefreshing = false;

  public state = signal<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  });

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const tokens = getStoredTokens();
    
    if (tokens) {
      const isAccessTokenValid = isTokenValid(tokens);
      
      this.state.update(s => ({
        ...s,
        tokens,
        isAuthenticated: isAccessTokenValid
      }));
      
      if (isAccessTokenValid) {
        this.loadUserProfile().subscribe({
          error: (error) => console.error('Failed to load profile:', error)
        });
      }
    }
  }

  login(credentials: LoginCredentials): Observable<any> {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));

    return this.http.post<any>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        const expiresAt = Date.now() + this.ACCESS_TOKEN_EXPIRY;

        const user: User = {
          id: response.id,
          username: response.username,
          email: response.email,
          firstName: response.firstName,
          lastName: response.lastName,
          gender: response.gender,
          image: response.image
        };

        const tokens: AuthTokens = {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresAt
        };

        this.state.update(s => ({
          ...s,
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));

        storeTokens(tokens);
        this.router.navigate(['/profile']);
      }),
      catchError(error => this.handleError(error, 'Ошибка входа. Проверьте логин и пароль.'))
    );
  }

  refreshToken(): Observable<AuthTokens> {
    if (this.isRefreshing) {
      return of(this.state().tokens!).pipe(
        filter(tokens => !!tokens),
        take(1)
      );
    }

    this.isRefreshing = true;
    const tokens = getStoredTokens();
    const refreshToken = tokens?.refreshToken;
    
    if (!refreshToken) {
      this.isRefreshing = false;
      return throwError(() => new Error('Нет refresh token'));
    }

    this.state.update(s => ({ ...s, isLoading: true }));

    return this.http.post<any>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
      tap(response => {
        const expiresAt = Date.now() + this.ACCESS_TOKEN_EXPIRY;

        const newTokens: AuthTokens = {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresAt
        };

        this.state.update(s => ({
          ...s,
          tokens: newTokens,
          isAuthenticated: true,
          isLoading: false
        }));
        
        storeTokens(newTokens);
        this.isRefreshing = false;
      }),
      catchError(error => {
        this.state.update(s => ({ ...s, isLoading: false }));
        this.isRefreshing = false;
        this.logoutWithError('Не удалось обновить сессию. Войдите снова.');
        return throwError(() => error);
      })
    );
  }

  loadUserProfile(): Observable<User> {
    const tokens = getStoredTokens();
    
    if (!tokens?.accessToken) {
      return this.refreshToken().pipe(
        switchMap(() => this.loadUserProfile()),
        take(1)
      );
    }

    this.state.update(s => ({ ...s, isLoading: true, error: null }));

    return this.http.get<User>(`${this.API_URL}/me`, { 
      headers: new HttpHeaders({
        'Authorization': `Bearer ${tokens.accessToken}`
      })
    }).pipe(
      tap(user => {
        this.state.update(s => ({
          ...s,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            gender: user.gender,
            image: user.image
          },
          isLoading: false,
          error: null
        }));
      }),
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => this.loadUserProfile()),
            catchError(() => {
              this.logoutWithError('Сессия истекла. Войдите снова.');
              return throwError(() => new Error('Сессия истекла. Войдите снова.'));
            })
          );
        }
        return this.handleError(error, 'Ошибка загрузки профиля');
      })
    );
  }

  checkAuth(): Observable<boolean> {
    const tokens = getStoredTokens();
    
    if (!tokens) {
      return of(false);
    }
    
    if (isTokenValid(tokens)) {
      return of(true);
    }
    
    if (tokens.refreshToken) {
      return this.refreshToken().pipe(
        map(() => true),
        catchError(() => of(false))
      );
    }
    
    return of(false);
  }

  logout(): void {
    this.logoutWithError(null);
  }

  private logoutWithError(errorMessage: string | null): void {
    this.state.update(state => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: errorMessage
    }));

    clearTokens();
    this.router.navigate(['/login']);
  }

  private handleError(error: any, defaultMessage: string): Observable<never> {
    let errorMessage = defaultMessage;
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    }

    this.state.update(s => ({
      ...s,
      isLoading: false,
      error: errorMessage
    }));
    
    return throwError(() => error);
  }
}