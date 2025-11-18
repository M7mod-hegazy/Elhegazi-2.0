import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Orders = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to order history page
    navigate('/order-history');
  }, [navigate]);

  return null;
};

export default Orders;