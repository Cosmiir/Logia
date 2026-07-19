import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container component pour le contenu principal
 * Applique les marges horizontales uniformes de 40px sur toute l'application
 * Utilisé par Header et MainContent pour garantir l'alignement
 */
export const Container: React.FC<ContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`w-full px-10 ${className}`}>
      {children}
    </div>
  );
};
