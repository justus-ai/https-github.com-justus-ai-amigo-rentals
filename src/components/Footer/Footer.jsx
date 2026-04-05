import React from 'react';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className='footer-accent' />

      <div className='footer-inner'>
        <div>
          <h3>Amigon Rentals</h3>
          <p>Find your next home with confidence and comfort.</p>
          <p>Open 24 Hours</p>

          <div className='socials' aria-label='Social media links'>
            <a href='https://facebook.com' target='_blank' rel='noreferrer' aria-label='Facebook'>
              <Facebook size={18} />
            </a>
            <a href='https://instagram.com' target='_blank' rel='noreferrer' aria-label='Instagram'>
              <Instagram size={18} />
            </a>
            <a href='https://twitter.com' target='_blank' rel='noreferrer' aria-label='Twitter'>
              <Twitter size={18} />
            </a>
            <a href='https://youtube.com' target='_blank' rel='noreferrer' aria-label='YouTube'>
              <Youtube size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
