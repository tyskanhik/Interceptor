import { Component, inject, OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnDestroy {
  protected authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    if (this.authService.state().isAuthenticated && !this.authService.state().user) {
      this.loadProfile();
    }
  }

  loadProfile(): void {
    this.authService.loadUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  refreshToken(): void {
    this.authService.refreshToken()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: () => {
        this.loadProfile();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}