#!/bin/bash
# CHATBOT_QUICKSTART.sh — Get the AI chatbot running in 5 minutes

set -e

echo "🤖 HeelPlan AI Chatbot — Quick Start Setup"
echo "=========================================="

# Step 1: Get API Key
echo ""
echo "📝 Step 1: Get Gemini API Key"
echo "  1. Go to https://aistudio.google.com/app/apikeys"
echo "  2. Click 'Create API Key' (in new project)"
echo "  3. Copy the key to clipboard"
echo ""
read -p "Paste your GEMINI_API_KEY and press Enter: " GEMINI_API_KEY

# Step 2: Set up environment
echo ""
echo "⚙️  Step 2: Configure Environment"

# Create .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env..."
    cat > backend/.env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/heelplan
GEMINI_API_KEY=$GEMINI_API_KEY
CONSTRAINTS_DB=.constraints.json
EOF
else
    # Update existing .env with GEMINI_API_KEY
    if grep -q "GEMINI_API_KEY" backend/.env; then
        sed -i '' "s/GEMINI_API_KEY=.*/GEMINI_API_KEY=$GEMINI_API_KEY/" backend/.env
    else
        echo "GEMINI_API_KEY=$GEMINI_API_KEY" >> backend/.env
    fi
fi

echo "✓ backend/.env configured"

# Step 3: Install dependencies
echo ""
echo "📦 Step 3: Install Dependencies"

cd backend
echo "Installing Python packages..."
pip install -r requirements.txt > /dev/null 2>&1 || pip install -r requirements.txt

cd ../frontend
echo "Installing Node packages..."
npm install > /dev/null 2>&1 || npm install

cd ..

# Step 4: Show startup instructions
echo ""
echo "🚀 Step 4: Start the Application"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  uvicorn main:app --reload --port 8000"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"

# Step 5: Test the feature
echo ""
echo "✅ Ready to test! Try these messages in the chat:"
echo ""
echo "  • 'Block lunch from 12 to 1 PM on weekdays'"
echo "  • 'No classes before 9 AM'"
echo "  • 'Gym on Monday, Wednesday, Friday from 6 to 7 PM'"
echo "  • 'Keep Friday afternoons free'"
echo ""
echo "For full documentation, see: CHATBOT_IMPLEMENTATION.md"
echo ""
