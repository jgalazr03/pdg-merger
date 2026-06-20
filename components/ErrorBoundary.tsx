'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
  /** Nombre legible de la sección, para el mensaje ("No se pudo cargar {label}"). */
  label?: string;
  /** Fallback a medida; si se omite, se usa la tarjeta por defecto. */
  fallback?: ReactNode;
};

type State = { error: Error | null };

/**
 * Aísla un subárbol de la UI: si un componente lanza durante el render, el error
 * se contiene aquí en vez de propagarse a Next y tumbar TODA la página —lo que
 * dispararía "Application error" y borraría el progreso en memoria (la
 * transcripción no se persiste en ningún backend todavía). Muestra un fallback
 * local con opción de reintentar; el resto de la app sigue viva.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola para depurar, sin romper la app.
    console.error(
      '[ErrorBoundary]',
      this.props.label ?? '',
      error,
      info.componentStack
    );
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="m-4 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              No se pudo cargar {this.props.label ?? 'esta sección'}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tu transcripción sigue intacta. Puedes reintentar o seguir usando
              el resto.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.reset}
              className="mt-3"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
