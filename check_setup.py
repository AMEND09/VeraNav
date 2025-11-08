"""
Vera Navigator - System Check
Verifies all dependencies and services are properly configured
"""

import sys
import importlib
import os
from pathlib import Path

def check_python_version():
    """Check Python version"""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"✗ Python {version.major}.{version.minor}.{version.micro} (requires 3.8+)")
        return False

def check_module(module_name, display_name=None):
    """Check if a Python module is installed"""
    if display_name is None:
        display_name = module_name
    
    try:
        importlib.import_module(module_name)
        print(f"✓ {display_name}")
        return True
    except ImportError:
        print(f"✗ {display_name} - Not installed")
        return False

def check_file(filepath, description):
    """Check if a file exists"""
    if Path(filepath).exists():
        print(f"✓ {description}")
        return True
    else:
        print(f"✗ {description} - Not found at {filepath}")
        return False

def check_env_var(var_name):
    """Check if environment variable is set"""
    value = os.environ.get(var_name)
    if value:
        # Mask API keys for security
        if 'key' in var_name.lower() or 'secret' in var_name.lower():
            masked = value[:8] + '...' if len(value) > 8 else '***'
            print(f"✓ {var_name} = {masked}")
        else:
            print(f"✓ {var_name} = {value}")
        return True
    else:
        print(f"⚠ {var_name} - Not set")
        return False

def main():
    print("=" * 60)
    print("  Vera Navigator - System Check")
    print("=" * 60)
    print()
    
    all_ok = True
    
    # Python version
    print("Python Version:")
    all_ok &= check_python_version()
    print()
    
    # Core dependencies
    print("Core Dependencies:")
    all_ok &= check_module('flask', 'Flask')
    all_ok &= check_module('flask_cors', 'Flask-CORS')
    print()
    
    # Whisper dependencies
    print("Whisper (Speech-to-Text):")
    all_ok &= check_module('whisper', 'OpenAI Whisper')
    all_ok &= check_module('torch', 'PyTorch')
    print()
    
    # YOLOv8 dependencies
    print("YOLOv8 (Object Detection):")
    all_ok &= check_module('ultralytics', 'Ultralytics YOLOv8')
    all_ok &= check_module('cv2', 'OpenCV')
    print()
    
    # Additional dependencies
    print("Additional Dependencies:")
    all_ok &= check_module('numpy', 'NumPy')
    all_ok &= check_module('PIL', 'Pillow')
    print()
    
    # Check for YAMNet model
    print("Models:")
    yamnet_path = Path('NAIN/static/vendor/yamnet.tflite')
    check_file(yamnet_path, 'YAMNet model (yamnet.tflite)')
    print()
    
    # Check .env file
    print("Configuration:")
    env_exists = check_file('.env', '.env file')
    if env_exists:
        # Try to load .env if python-dotenv is available
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
        
        print("\nEnvironment Variables:")
        check_env_var('GEMINI_API_KEY')
        check_env_var('WHISPER_SERVER_URL')
        check_env_var('YOLO_SERVICE_URL')
    else:
        print("⚠ Create .env file from .env.example")
    print()
    
    # Summary
    print("=" * 60)
    if all_ok:
        print("✓ All critical dependencies are installed!")
        print("\nYou can now run:")
        print("  npm run dev")
    else:
        print("✗ Some dependencies are missing.")
        print("\nTo install missing dependencies:")
        print("  pip install -r requirements.txt")
    print("=" * 60)

if __name__ == '__main__':
    main()
