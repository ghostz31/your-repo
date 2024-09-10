import React from 'react';
import { Link } from 'react-router-dom';
import './LegalMentions.css';

function LegalMentions() {
  return (
    <div className="legal-mentions">
      <h1>Legal Mentions</h1>
      <section>
        <h2>1. Website Owner</h2>
        <p>This website is owned and operated by Brinko.</p>
        <p>Address: 31000 Toulouse</p>
        <p>Email: brinko@fun.com</p>
      </section>
      <section>
        <h2>2. Hosting</h2>
        <p>This website is hosted by Netlify.</p>
        <p>Address: brinko.fun </p>
      </section>
      <section>
        <h2>3. Personal Data Protection</h2>
        <p>In accordance with the General Data Protection Regulation (GDPR), users have the right to access, rectify, and delete their personal data. To exercise these rights, please contact us at brinko@fun.com.</p>
      </section>
      <section>
        <h2>4. Intellectual Property</h2>
        <p>All content on this website, including but not limited to text, graphics, logos, images, and software, is the property of Brinko or its content suppliers and is protected by international copyright laws.</p>
      </section>
      <section>
        <h2>5. Cookies</h2>
        <p>This website uses cookies to enhance user experience. By using our website, you consent to our use of cookies in accordance with our Privacy Policy.</p>
      </section>
      <section>
        <h2>6. Disclaimer</h2>
        <p>The information provided on this website is for general informational purposes only. We make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability or availability with respect to the website or the information, products, services, or related graphics contained on the website for any purpose.</p>
      </section>
      <Link to="/" className="back-link">Back to Home</Link>
    </div>
  );
}

export default LegalMentions;