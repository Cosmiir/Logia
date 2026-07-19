import React from 'react';
import { Container } from './Container';

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Header component - Barre de navigation principale
 * Utilise Container pour aligner le contenu avec le reste de l'application
 * Hauteur fixe de 16 (64px) avec backdrop-blur
 */
export const Header: React.FC<HeaderProps> = ({ children, className = '' }) => {
  return (
    <header className={`h-16 shrink-0 header-glass z-30 relative ${className}`}>
      <Container className="h-full flex items-center justify-between">
        {children}
      </Container>
    </header>
  );
};
