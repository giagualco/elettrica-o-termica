"""
Elettrica o termica? — versione Streamlit.

Il calcolatore vero e proprio è `index.html`: una pagina sola, senza dipendenze,
che funziona anche aperta da disco. Qui viene semplicemente incorporata, così che
esista un'unica versione da mantenere e i due canali di pubblicazione — GitHub
Pages e Streamlit — non possano divergere nei numeri.
"""

from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

PAGINA = Path(__file__).parent / "index.html"

st.set_page_config(
    page_title="Elettrica o termica?",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Lo sfondo di Streamlit deve sparire: la pagina incorporata ha il suo,
# ed è scuro. Senza questo si vedrebbe una cornice chiara attorno.
st.markdown(
    """
    <style>
      #MainMenu, header, footer {visibility: hidden;}
      .stApp {background: #080A0F;}
      .block-container {padding: 0 !important; max-width: 100% !important;}
      iframe {border: 0; width: 100%;}
    </style>
    """,
    unsafe_allow_html=True,
)

if not PAGINA.exists():
    st.error(
        "Manca il file `index.html`, che contiene il calcolatore. "
        "Deve stare nella stessa cartella di questo script."
    )
    st.stop()

components.html(PAGINA.read_text(encoding="utf-8"), height=1500, scrolling=True)
