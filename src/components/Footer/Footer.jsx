import React from 'react';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import './Footer.css';

const XIcon = ({ size = 18 }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='currentColor'
    aria-hidden='true'
  >
    <path d='M18.244 2H21.58l-7.29 8.328L23 22h-6.81l-5.34-6.985L4.74 22H1.4l7.795-8.909L1 2h6.984l4.828 6.367L18.244 2Zm-1.17 18h1.848L6.98 3.894H5.01L17.074 20Z' />
  </svg>
);

const Footer = () => {
  return (
    <footer className="footer">
      <div className='footer-accent' />

      <div className='footer-inner'>
        <div>
          <h3>Amigo Rentals</h3>
          <p>Find your next home with confidence and comfort.</p>
          <p>Open 24 Hours</p>
          <nav className='footer-links' aria-label='Legal and support links'>
            <a href='#/terms'>Terms</a>
            <a href='#/privacy'>Privacy</a>
            <a href='#/refund'>Refunds</a>
            <a href='#/support'>Support</a>
          </nav>

          <div className='socials' aria-label='Social media links'>
            <a href='https://www.facebook.com/people/Amigo-Rentals/61572923203658/' target='_blank' rel='noreferrer' aria-label='Facebook'>
              <Facebook size={18} />
            </a>
            <a href='https://www.instagram.com/amigorentals/' target='_blank' rel='noreferrer' aria-label='Instagram'>
              <Instagram size={18} />
            </a>
            <a href='https://x.com/amigorental' target='_blank' rel='noreferrer' aria-label='X'>
              <XIcon size={18} />
            </a>
            <a href='https://www.youtube.com/@amigorental1471' target='_blank' rel='noreferrer' aria-label='YouTube'>
              <Youtube size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
