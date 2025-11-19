import { useParams } from 'react-router-dom';
import Products from './Products';

const Category = () => {
  const { slug } = useParams();
  return <Products />;
};

export default Category;
