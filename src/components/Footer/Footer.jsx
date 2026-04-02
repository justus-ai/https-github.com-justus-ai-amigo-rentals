import React from 'react';
import { Mail, Phone, MapPin, Clock3, Facebook, Instagram, Linkedin } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className='footer-accent' />

      <div className='footer-inner'>
        <div>
          <h3>Amigo Rentals</h3>
          <p>Find your next home with confidence and comfort.</p>
        </div>

        <div>
          <h4>Quick Links</h4>
          <ul className='footer-links'>
            <li><a href='#'>Properties</a></li>
            <li><a href='#'>Locations</a></li>
            <li><a href='#'>Contact</a></li>
          </ul>
        </div>

        <div>
          <h4>Contact</h4>
          <p><Phone size={16} /> +254 790 443 776</p>
          <p><Mail size={16} /> info@amigorentals.com</p>
          <p><MapPin size={16} /> Nairobi, Kenya</p>
          <p><Clock3 size={16} /> Open 24 Hours</p>
          <div className='socials'>
            <a href='#' aria-label='Facebook'><Facebook size={18} /></a>
            <a href='#' aria-label='Instagram'><Instagram size={18} /></a>
            <a href='#' aria-label='LinkedIn'><Linkedin size={18} /></a>
          </div>
        </div>
      </div>

      <div className='footer-bottom'>
        © 2026 Amigo Rentals. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
