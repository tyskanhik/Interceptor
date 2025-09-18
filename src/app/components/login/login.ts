import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AuthService } from '../../services/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit, OnDestroy {
  protected authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = signal<string>('emilys');
  password = signal<string>('emilyspass');
  
  errorMessage = signal<string | null>(null);
  infoMessage = signal<string | null>(null);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['message']) {
          this.infoMessage.set(params['message']);
        }
    });

    if (this.authService.state().isAuthenticated) {
      this.router.navigate(['/profile']);
    }
  }

  onSubmit(): void {
    if (!this.username() || !this.password()) {
      this.errorMessage.set('Заполните все поля');
      return;
    }

    const credentials = {
      username: this.username(),
      password: this.password()
    };

    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.authService.login(credentials)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          // Ошибка обрабатывается в сервисе
        }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}