Caveats:
- cannot render above 50fps while running inside claude code without risk of screen tearing (possible screen tearing regardless)
- cannot enable pixel mouse position reporting, so the mouse position will almost always be slightly off, and in some cases making interacting with some elements not possible
- the plugin needs to make fetch requests to a local http server to communicate with the terminal-browser CLI, which may cause a prompt to show in your OS that your terminal wants to access the local network
- claude code sets a very high min width for the chat area, so its sometimes not possible to resize the browser to the size you want