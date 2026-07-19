import React from 'react';
import CreateProfile from '@/pages/CreateProfile';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  return <CreateProfile isOnboarding onComplete={onComplete} />;
};

export default Onboarding;
