from flask import Flask, request, send_file
import fitz  # PyMuPDF
import io

app = Flask(__name__)

@app.route('/process_pdf', methods=['POST'])
def process_pdf():
    text = request.form['text']
    pdf_file = request.files['pdfFile']

    # Open the PDF
    pdf_document = fitz.open(stream=pdf_file.read(), filetype="pdf")

    # Define text properties
    font_size = 12
    white_color = (1, 1, 1)  # RGB for white

    for page_num in range(len(pdf_document)):
        page = pdf_document.load_page(page_num)
        page_width = page.rect.width
        page_height = page.rect.height

        # Add text to the top of the page
        page.insert_text(
            fitz.Point(10, 10),
            text,
            fontsize=font_size,
            color=white_color
        )
        # Add text to the bottom of the page
        page.insert_text(
            fitz.Point(10, page_height - 20),
            text,
            fontsize=font_size,
            color=white_color
        )

    # Save the modified PDF to a bytes buffer
    pdf_bytes = pdf_document.write()
    pdf_buffer = io.BytesIO(pdf_bytes)

    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='modified.pdf'
    )

if __name__ == '__main__':
    app.run(debug=True)
