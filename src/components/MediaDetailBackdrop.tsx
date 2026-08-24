import React from 'react';

interface MediaDetailBackdropProps {
  src: string;
}

/**
 * MediaDetailBackdrop — Hero backdrop image displayed as a background at the
 * top of the media detail page when a backdrop image is available.
 *
 * Lisibilité :
 *  - Un voile linéaire assombrit progressivement le côté gauche (là où vivent
 *    le titre, les métadonnées, le synopsis et le casting), quel que soit le
 *    contenu de l'image en dessous, tout en laissant le côté droit de l'image
 *    respirer et rester visuellement riche.
 *  - Un fondu supplémentaire en bas de la zone renforce le contraste sous la
 *    rangée de casting.
 *  - Un vignettage doux ajoute de la profondeur derrière le bloc de texte.
 */
export const MediaDetailBackdrop: React.FC<MediaDetailBackdropProps> = ({ src }) => {
  if (!src) return null;

  return (
    <div
      className="absolute top-6 right-8 w-[76%] max-w-[1380px] h-[620px] pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
      }}
    >
      <div
        className="w-full h-full relative"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 76%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 76%, transparent 100%)',
        }}
      >
        {/* Crisp 1080p Backdrop image */}
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover object-top filter brightness-[0.95] contrast-[1.03]"
          draggable={false}
        />

        {/* Reading scrim — strong on the left (text side), fading out further right
            than before to keep the synopsis column readable even against bright
            image content, while the far-right of the image stays vivid. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(6,7,14,0.86) 0%, rgba(6,7,14,0.66) 26%, rgba(6,7,14,0.40) 48%, rgba(6,7,14,0.18) 68%, transparent 88%)',
          }}
        />

        {/* Soft depth vignette centered behind the hero copy */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 72% 90% at 22% 40%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.18) 45%, transparent 74%)',
            mixBlendMode: 'multiply',
          }}
        />

        {/* Bottom fade — keeps the cast row (base of the hero) on a dark, readable surface */}
        <div
          className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(8,9,15,0.6) 0%, rgba(8,9,15,0.15) 60%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
};

export default MediaDetailBackdrop;