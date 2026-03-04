// Updated imports in PdfSidebar.tsx
import { Icon } from 'path-to-icon-component'; // Adjust path accordingly

// Replace all direct icon imports from lucide-react
import { Edit, Trash2 } from 'lucide-react'; // Example - Remove this line
// Use component instead of direct imports in code

const PdfSidebar = () => {
  return (
    <div>
      <Icon name="edit" />
      <Icon name="trash2" />
    </div>
  );
};

export default PdfSidebar;