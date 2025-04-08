from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import os
from werkzeug.utils import secure_filename
import numpy as np
import requests
from io import BytesIO
from PIL import Image
import base64
import tempfile
import json

app = Flask(__name__, 
            template_folder='../templates',  # Adjust template folder for Vercel
            static_folder='../static')       # Adjust static folder for Vercel

# Configure for Vercel
app.config['UPLOAD_FOLDER'] = '/tmp'  # Use /tmp for Vercel
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Global variable to store current dataframe (Note: This will reset on each serverless invocation)
current_df = None
current_file_path = None

def process_image_url(url):
    """Process image URL and return base64 encoded image"""
    try:
        if not url or "http" not in str(url):
            return None
            
        # Process URL (replace parameters for Myntra URLs)
        url = str(url)
        url = url.replace("($height)", "150")
        url = url.replace("($qualityPercentage)", "80")
        url = url.replace("($width)", "120")
        
        # Set up request headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Make request
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            # Open and resize image
            img = Image.open(BytesIO(response.content))
            img = img.resize((120, 150), Image.LANCZOS)
            
            # Convert to base64
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            return base64.b64encode(buffered.getvalue()).decode()
            
    except Exception as e:
        print(f"Error processing image {url}: {e}")
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global current_df, current_file_path
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith(('.xlsx', '.xls')):
        try:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # Read the Excel file
            current_df = pd.read_excel(file_path)
            current_file_path = file_path
            
            # Replace NaN values with empty strings
            current_df = current_df.replace({np.nan: ''})
            
            # Process images and prepare data
            processed_data = []
            for _, row in current_df.iterrows():
                row_dict = row.to_dict()
                # Process image if Value column contains URL
                if 'Value' in row_dict and isinstance(row_dict['Value'], str) and 'http' in row_dict['Value']:
                    row_dict['image'] = process_image_url(row_dict['Value'])
                processed_data.append(row_dict)
            
            # Convert DataFrame to dict for JSON response
            columns = current_df.columns.tolist()
            
            # Clean up the temporary file
            os.remove(file_path)
            
            return jsonify({
                'data': processed_data,
                'columns': columns,
                'message': 'File uploaded successfully'
            })
        except Exception as e:
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/update', methods=['POST'])
def update_value():
    try:
        data = request.json
        row_index = data.get('row_index')
        value = data.get('value')
        
        if row_index is not None and value is not None:
            return jsonify({
                'message': f'Updated row {row_index + 1} to {value}',
                'success': True
            })
        else:
            return jsonify({'error': 'Invalid update data'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download_file():
    try:
        # Get updated data from request
        updated_data = request.json.get('data', [])
        filename = request.json.get('filename', 'updated_file.xlsx')
        
        # Convert to DataFrame
        new_df = pd.DataFrame(updated_data)
        
        # Remove image column if it exists
        if 'image' in new_df.columns:
            new_df = new_df.drop('image', axis=1)
        
        # Replace empty strings with NaN before saving
        new_df = new_df.replace('', np.nan)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            # Save to temporary Excel file
            new_df.to_excel(temp_file.name, index=False)
            
            # Create filename with _update extension
            file_parts = filename.split('.')
            extension = file_parts.pop()
            base_name = '.'.join(file_parts)
            download_filename = f"{base_name}_update.{extension}"
            
            # Return the file
            response = send_file(
                temp_file.name,
                as_attachment=True,
                download_name=download_filename,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            
            # Clean up the temporary file after sending
            os.remove(temp_file.name)
            
            return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# For Vercel
app = app.wsgi_app 