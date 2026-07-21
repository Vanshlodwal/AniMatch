// Floating particle background
const PARTICLE_CONFIG = [
  { color: 'rgba(138,99,255,0.6)', size: 4, duration: 14, delay: 0,  left: '10%' },
  { color: 'rgba(255,79,163,0.5)', size: 3, duration: 18, delay: 3,  left: '25%' },
  { color: 'rgba(0,229,213,0.5)', size: 5, duration: 12, delay: 6,  left: '50%' },
  { color: 'rgba(138,99,255,0.4)', size: 3, duration: 20, delay: 9,  left: '70%' },
  { color: 'rgba(255,196,78,0.4)', size: 4, duration: 16, delay: 2,  left: '85%' },
  { color: 'rgba(255,79,163,0.4)', size: 2, duration: 22, delay: 5,  left: '35%' },
  { color: 'rgba(0,229,213,0.35)', size: 3, duration: 15, delay: 11, left: '60%' },
  { color: 'rgba(138,99,255,0.5)', size: 5, duration: 17, delay: 8,  left: '15%' },
];

export default function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {PARTICLE_CONFIG.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            width:  p.size,
            height: p.size,
            background: p.color,
            left: p.left,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
