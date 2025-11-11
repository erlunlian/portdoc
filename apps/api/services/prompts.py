"""System prompts for RAG and LLM interactions"""


def build_rag_system_prompt(chunks: list[dict]) -> str:
    """
    Build system prompt for RAG-based document Q&A.

    Args:
        chunks: List of document chunks with 'page' and 'text' keys

    Returns:
        System prompt string for the LLM
    """
    if not chunks:
        # If no chunks were retrieved, provide a helpful message
        return """You are a helpful AI assistant for a PDF document reader.

Unfortunately, I don't have access to the document content right now. This might be because:
- The document is still being processed
- The document embeddings haven't been generated yet
- There was an error retrieving the document content

Please ask the user to wait a moment for the document to finish processing, or inform them that they may need to re-upload the document."""

    # Build context from chunks
    context = "\n\n".join([f"[Page {chunk['page']}]\n{chunk['text']}" for chunk in chunks])

    return f"""You are a helpful AI assistant that answers questions about a PDF document.

Your task is to answer questions based ONLY on the provided context from the document.

Context from the document:
{context}

Guidelines:
- Always cite the page number when referencing information (e.g., "According to page 5...")
- If the answer is not in the provided context, clearly state "I don't have enough information in the document to answer that question."
- Be concise and accurate
- If multiple pages contain relevant information, cite all of them
- Do not make up information or use external knowledge"""


def build_rag_user_prompt_with_context(user_message: str, chunks: list[dict]) -> str:
    """
    Build user prompt that includes both the document context and the user's question.
    This is the standard RAG approach - context goes in user message, instructions in system.

    Args:
        user_message: The user's question
        chunks: List of document chunks with 'page' and 'text' keys

    Returns:
        User prompt string that includes context
    """
    if not chunks:
        return user_message

    # Build context from chunks
    context = "\n\n".join([f"[Page {chunk['page']}]\n{chunk['text']}" for chunk in chunks])

    return f"""Here is the relevant context from a PDF document:

{context}

Based ONLY on the above context from the document, please answer the following question. Always cite page numbers when referencing information.

Question: {user_message}"""


def build_title_generation_messages(user_message: str) -> list[dict]:
    """
    Build messages for generating thread titles from user queries.

    Args:
        user_message: The first user message in the thread

    Returns:
        List of message dicts for LLM API
    """
    return [
        {
            "role": "system",
            "content": "You are a helpful assistant that generates concise, descriptive titles. Generate a title that is exactly 4 words or less. Return only the title text, no quotes or punctuation.",
        },
        {
            "role": "user",
            "content": f"Generate a concise title (maximum 4 words) for a conversation that starts with this message:\n\n{user_message[:500]}",
        },
    ]
