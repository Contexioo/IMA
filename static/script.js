document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const tableContainer = document.getElementById('tableContainer');
    
    let currentData = [];
    let currentColumns = [];
    let originalFileName = '';

    // Handle file upload
    uploadBtn.addEventListener('click', async function() {
        const file = fileInput.files[0];
        if (!file) {
            updateStatus('Please select a file first', 'warning');
            return;
        }

        // Store original filename for download
        originalFileName = file.name;

        const formData = new FormData();
        formData.append('file', file);

        try {
            updateStatus('Uploading file...', 'info');
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (response.ok) {
                currentData = result.data;
                currentColumns = result.columns;
                displayData(currentData, currentColumns);
                saveBtn.disabled = false;
                updateStatus('File uploaded successfully', 'success');
            } else {
                updateStatus(result.error || 'Upload failed', 'danger');
            }
        } catch (error) {
            updateStatus('Error uploading file: ' + error.message, 'danger');
        }
    });

    // Handle download changes
    saveBtn.addEventListener('click', async function() {
        try {
            updateStatus('Preparing download...', 'info');
            
            // Get all current data from the screen
            const rows = tableContainer.querySelectorAll('.data-row');
            rows.forEach((row, rowIndex) => {
                const fields = row.querySelectorAll('.field-value');
                fields.forEach((field, colIndex) => {
                    const columnName = currentColumns[colIndex];
                    currentData[rowIndex][columnName] = field.textContent;
                });
            });
            
            // Create download request
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    data: currentData,
                    filename: originalFileName
                })
            });

            if (response.ok) {
                // Get the blob from the response
                const blob = await response.blob();
                
                // Create a download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                
                // Create filename with _update extension
                const fileNameParts = originalFileName.split('.');
                const extension = fileNameParts.pop();
                const baseName = fileNameParts.join('.');
                const downloadFileName = `${baseName}_update.${extension}`;
                
                a.download = downloadFileName;
                document.body.appendChild(a);
                a.click();
                
                // Clean up
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                updateStatus('File downloaded successfully', 'success');
            } else {
                const result = await response.json();
                updateStatus(result.error || 'Download failed', 'danger');
            }
        } catch (error) {
            updateStatus('Error downloading file: ' + error.message, 'danger');
        }
    });

    // Display data in rows
    function displayData(data, columns) {
        tableContainer.innerHTML = '';
        
        data.forEach((row, rowIndex) => {
            const rowElement = document.createElement('div');
            rowElement.className = 'data-row';
            
            // Create data fields container
            const dataFields = document.createElement('div');
            dataFields.className = 'data-fields';
            
            // Add each field
            columns.forEach(col => {
                const fieldContainer = document.createElement('div');
                fieldContainer.className = 'field-container';
                
                const fieldLabel = document.createElement('div');
                fieldLabel.className = 'field-label';
                fieldLabel.textContent = col;
                
                const fieldValue = document.createElement('div');
                fieldValue.className = 'field-value';
                fieldValue.textContent = row[col] || '';
                
                fieldContainer.appendChild(fieldLabel);
                fieldContainer.appendChild(fieldValue);
                dataFields.appendChild(fieldContainer);
            });
            
            // Create image container
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            if (row.image) {
                const img = document.createElement('img');
                img.src = `data:image/png;base64,${row.image}`;
                img.alt = 'Product Image';
                imageContainer.appendChild(img);
            }
            
            // Create buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'buttons-container';
            
            const buttonValues = ['Front', 'Back', 'Side', 'Null'];
            buttonValues.forEach(value => {
                const button = document.createElement('button');
                button.className = 'btn btn-outline-primary update-btn';
                button.textContent = value;
                button.onclick = () => updateValue(rowIndex, value);
                buttonsContainer.appendChild(button);
            });
            
            // Append all containers to row
            rowElement.appendChild(dataFields);
            rowElement.appendChild(imageContainer);
            rowElement.appendChild(buttonsContainer);
            
            tableContainer.appendChild(rowElement);
        });
    }

    // Update value function
    async function updateValue(rowIndex, value) {
        try {
            // Find the Update field in the row
            const row = tableContainer.children[rowIndex];
            const fields = row.querySelectorAll('.field-value');
            let updateField = null;
            
            // Find the Update field by matching the label
            const labels = row.querySelectorAll('.field-label');
            labels.forEach((label, index) => {
                if (label.textContent === 'Update') {
                    updateField = fields[index];
                }
            });
            
            if (!updateField) {
                updateStatus('Update field not found', 'danger');
                return;
            }
            
            // Update the display
            updateField.textContent = value;
            
            // Update the data
            currentData[rowIndex]['Update'] = value;
            
            // Send update to server
            const response = await fetch('/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    row_index: rowIndex,
                    value: value
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                updateStatus(result.message, 'success');
            } else {
                updateStatus(result.error || 'Update failed', 'danger');
            }
        } catch (error) {
            updateStatus('Error updating value: ' + error.message, 'danger');
        }
    }

    // Update status message
    function updateStatus(message, type) {
        status.textContent = message;
        status.className = `alert alert-${type}`;
    }
}); 