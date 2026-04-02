import React from 'react';
import './Header.css';
import { House, Phone, Mail } from 'lucide-react';

const Header = () => {
  return (
    <header className="header">
      <div className='item brand'>
        <House className='icon' />
        <span>Amigo Rentals</span>
      </div>
      <div className='item'>
        <Phone className='icon' />
        <span>Contact Us @ 00254790443776</span>
      </div>
      <div className='item'>
        <Mail className='icon' />
        <span>Email: info@amigorentals.com</span>
      </div>
    </header>
  );
};

export default Header;
