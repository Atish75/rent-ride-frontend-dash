import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext.jsx';
import { API_BASE_URL } from './config';
import './App.css';

// --- STYLED CONSTANTS (MODULAR CSS-IN-JS) ---
const STYLES = {
  container: { padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: '1280px', margin: '0 auto' },
  navbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  searchWrapper: { margin: '1.5rem 0 2rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
  searchInput: {
    background: '#fff',
    color: '#1a1a1a',
    width: '100%',
    maxWidth: '500px',
    padding: '12px 20px',
    fontSize: '0.95rem',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    outline: 'none',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' },
  card: { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardImage: { width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  primaryBtn: { padding: '0.6rem 1.2rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  secondaryBtn: { padding: '0.6rem 1.2rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '6px', cursor: 'pointer' },
};

function HomePage() {
  // --- STATE MANAGEMENT ---
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Booking Form State
  const [selectedCar, setSelectedCar] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({
    startDate: '',
    endDate: '',
    startPoint: '',
    endPoint: '',
  });

  // User Role State
  const [userRoles, setUserRoles] = useState({ isOwner: false, isDriver: false });

  const navigate = useNavigate();
  const { isAuthenticated, logoutUser } = useContext(AuthContext);

  // --- API SERVICES & SIDE EFFECTS ---
  
  // Fetch Cars Catalog
  useEffect(() => {
    const controller = new AbortController();
    
    async function fetchCars() {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/cars/`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        setCars(data);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch cars:', error);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchCars();
    return () => controller.abort();
  }, []);

  // Fetch User Permissions Profile
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const controller = new AbortController();
    const token = localStorage.getItem('access_token');

    async function fetchUserProfile() {
      try {
        const response = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to resolve profile roles');
        const data = await response.json();
        setUserRoles({ isOwner: Boolean(data.is_owner), isDriver: Boolean(data.is_driver) });
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Profile fetch error:', error);
      }
    }

    fetchUserProfile();
    return () => controller.abort();
  }, [isAuthenticated]);

  // --- DERIVED STATE & MEMOIZATION ---
  
  // Dynamic Price Computation
  const totalPrice = useMemo(() => {
    const { startDate, endDate } = bookingDetails;
    if (!startDate || !endDate || !selectedCar) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return days > 0 ? days * Number(selectedCar.price_per_day) : 0;
  }, [bookingDetails.startDate, bookingDetails.endDate, selectedCar]);

  // Memoized Search Filtering
  const filteredCars = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return cars;

    return cars.filter((car) =>
      [car.name, car.brand, car.fuel_type, car.transmission].some(
        (field) => field?.toLowerCase().includes(query)
      )
    );
  }, [cars, searchTerm]);

  // --- HANDLERS ---
  
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setBookingDetails((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCar) return alert('Please select a vehicle.');
    if (totalPrice <= 0) return alert('Please select a valid duration.');

    const token = localStorage.getItem('access_token');
    const payload = {
      car: selectedCar.id,
      start_date: bookingDetails.startDate,
      end_date: bookingDetails.endDate,
      start_point: bookingDetails.startPoint,
      end_point: bookingDetails.endPoint,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/book-car/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 201) {
        alert('Booking successfully confirmed!');
        setSelectedCar(null);
        setBookingDetails({ startDate: '', endDate: '', startPoint: '', endPoint: '' });
        navigate('/booked-cars');
      } else if (response.status === 401) {
        alert('Session expired. Please log in again.');
        navigate('/login');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Transaction failed. Check details.');
      }
    } catch (error) {
      console.error('Booking network failure:', error);
      alert('Network communication error.');
    }
  };

  return (
    <div style={STYLES.container}>
      {/* NAVBAR */}
      <header style={STYLES.navbar}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>Rent Ride</h2>
        <nav style={{ display: 'flex', gap: '0.75rem' }}>
          {isAuthenticated ? (
            <>
              <button style={STYLES.secondaryBtn} onClick={() => navigate('/booked-cars')}>My Bookings</button>
              {userRoles.isDriver && (
                <button style={{ ...STYLES.primaryBtn, backgroundColor: '#f59e0b', color: '#000' }} onClick={() => navigate('/driver-dashboard')}>
                  🚕 Driver Dashboard
                </button>
              )}
              {userRoles.isOwner && (
                <button style={{ ...STYLES.primaryBtn, backgroundColor: '#7c3aed' }} onClick={() => navigate('/owner-dashboard')}>
                  🚙 My Fleet
                </button>
              )}
              <button style={STYLES.secondaryBtn} onClick={() => navigate('/profile')}>Profile 👤</button>
              <button style={{ ...STYLES.primaryBtn, backgroundColor: '#ef4444' }} onClick={logoutUser}>Logout</button>
            </>
          ) : (
            <>
              <button style={{ ...STYLES.primaryBtn, backgroundColor: '#10b981' }} onClick={() => navigate('/login')}>Login</button>
              <button style={STYLES.primaryBtn} onClick={() => navigate('/register')}>Sign Up</button>
            </>
          )}
        </nav>
      </header>

      <main>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#0f172a' }}>Fleet Selection</h1>

        {/* SEARCH CONTROLS */}
        <div style={STYLES.searchWrapper}>
          <input
            type="text"
            placeholder="🔍 Search by model, brand, fuel, or transmission..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={STYLES.searchInput}
          />
          {userRoles.isOwner && (
            <button style={{ ...STYLES.primaryBtn, backgroundColor: '#10b981', borderRadius: '24px' }} onClick={() => navigate('/add-cars')}>
              ➕ Add Vehicle
            </button>
          )}
        </div>

        {/* FLEET GRID */}
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#64748b' }}>Loading available fleet...</p>
        ) : filteredCars.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>No vehicles match your search criteria.</p>
        ) : (
          <div style={STYLES.grid}>
            {filteredCars.map((car) => (
              <article key={car.id} style={STYLES.card}>
                <img src={car.image} alt={`${car.brand} ${car.name}`} style={STYLES.cardImage} />
                <h3 style={{ margin: '0.75rem 0 0.25rem 0' }}>{car.name}</h3>
                <p style={{ color: '#059669', fontWeight: 600, margin: '0 0 1rem 0' }}>₹{car.price_per_day} / day</p>
                <button
                  style={{ ...STYLES.primaryBtn, width: '100%' }}
                  onClick={() => {
                    if (!isAuthenticated) {
                      alert('Please sign in to make a booking.');
                      navigate('/login');
                    } else {
                      setSelectedCar(car);
                    }
                  }}
                >
                  Reserve Vehicle
                </button>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* BOOKING MODAL */}
      {selectedCar && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalContent}>
            <h3 style={{ marginTop: 0 }}>Reserve {selectedCar.name}</h3>
            <form onSubmit={handleBookingSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Pickup Location</label>
                <input
                  type="text"
                  name="startPoint"
                  value={bookingDetails.startPoint}
                  onChange={handleInputChange}
                  placeholder="Enter pickup address"
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Drop-off Location</label>
                <input
                  type="text"
                  name="endPoint"
                  value={bookingDetails.endPoint}
                  onChange={handleInputChange}
                  placeholder="Enter destination address"
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={bookingDetails.startDate}
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={bookingDetails.endDate}
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem', fontWeight: 700, color: '#059669', fontSize: '1.1rem' }}>
                Total Rate: ₹{totalPrice}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setSelectedCar(null)} style={{ ...STYLES.secondaryBtn, flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" style={{ ...STYLES.primaryBtn, backgroundColor: '#059669', flex: 1 }}>
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
