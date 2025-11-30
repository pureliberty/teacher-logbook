import bcrypt

password = b'1234!'
hash_value = bcrypt.hashpw(password, bcrypt.gensalt())
print(hash_value.decode())
