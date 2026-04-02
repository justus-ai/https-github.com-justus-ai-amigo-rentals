import React from 'react';
import Header from './components/Header/Header';
import Title from './components/Title/Title';
import PropertyList from './components/PropertyList/PropertyList';
import Footer from './components/Footer/Footer';
import './components/App.css';
import properties from './Data/properties';

const App = () => {
  return (
    <div className='app'>
      <Header />
      <Title />
      <main className='app-main'>
        <PropertyList properties={properties} />
        
      </main>
      <Footer />
    </div>
  );
};

export default App;
