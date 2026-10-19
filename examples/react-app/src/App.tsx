import React, { useState } from 'react';

export function App() {
  const [isMember, setIsMember] = useState(false);

  return (
    <div className="app-container">
      <header>
        <h1>Welcome to Shallok Store</h1>
        <p>Your one-stop destination for global shopping.</p>
      </header>

      <section className="auth-card">
        <h2>Sign in to your account</h2>
        <form onSubmit={(e) => e.preventDefault()}>
          <label>Email address</label>
          <input type="email" placeholder="Enter your email" />
          <button type="submit" aria-label="Submit login form">
            Sign In
          </button>
        </form>
      </section>

      <section className="checkout-card">
        <h3>Checkout summary</h3>
        <p>Status: {isMember ? 'VIP Member' : 'Guest User'}</p>
        <button onClick={() => alert('Processing')}>Pay now</button>
      </section>
    </div>
  );
}

export default App;
