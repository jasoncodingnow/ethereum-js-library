const Buffer = require('safe-buffer').Buffer;

class RLP {

  constructor() {

  }

  encode(input) {
    if (input instanceof Array) {
      let output = [];
      for (let i = 0; i < input.length; i++) {
        output.push(this.encode(input[i]));
      }
      let buf = Buffer.concat(output);
      return Buffer.concat([this._encodeLength(buf.length, 192), buf]);
    } else {
      input = this._toBuffer(input);
      if (input.length === 1 && input[0] < 128) {
        return input;
      } else {
        return Buffer.concat([this._encodeLength(input.length, 128), input]);
      }
    }
  }

  decode(input, stream) {
    if (!input || input.length == 0) {
      return Buffer.from([])
    }

    input = this._toBuffer(input);
    var decoded = this._decode(input)

    if (stream) {
      return decoded
    }

    assert.equal(decoded.remainder.length, 0, 'invalid remainder')
    return decoded.data
  }

  getLength(input) {
    if (!input || input.length === 0) {
      return Buffer.from([])
    }
  
    input = this._toBuffer(input)
    var firstByte = input[0]
    if (firstByte <= 0x7f) {
      return input.length
    } else if (firstByte <= 0xb7) {
      return firstByte - 0x7f
    } else if (firstByte <= 0xbf) {
      return firstByte - 0xb6
    } else if (firstByte <= 0xf7) {
      return firstByte - 0xbf
    } else {
      var llength = firstByte - 0xf6
      var length = this._safeParseToInt(input.slice(1, llength).toString('hex'), 16)
      return llength + length
    }
  }

  _decode(input) {
    let length, data, llength, innerRemainder;

    let firstByte = input[0];
    if (firstByte <= 0x7f) {
      return {
        data: input.slice(0, 1),
        remainder: input.slice(1)
      }
    } else if (firstByte <= 0xb7) {
      length = firstByte - 0x7f;
      if (firstByte === 0x80) {
        data = Buffer.from([]);
      } else {
        data = input.slice(1, length);
      }

      if (length === 2 && data[0] < 0x80) {
        throw new Error('invalid rlp encoding: byte must be less 0x80')
      }

      return {
        data: data,
        remainder: input.slice(length)
      }
    } else if (firstByte <= 0xbf) {
      llength = firstByte - 0xb6;
      length = this._safeParseToInt(input.slice(1, llength).toString('hex', 16));
      data = input.slice(llength, length + llength);
      if (data.length < length) {
        throw (new Error('invalid RLP'))
      }
      return {
        data: data,
        remainder: input.slice(length + llength)
      }
    } else if (firstByte <= 0xf7) {
      length = firstByte - 0xbf
      innerRemainder = input.slice(1, length)
      while (innerRemainder.length) {
        d = this._decode(innerRemainder)
        decoded.push(d.data)
        innerRemainder = d.remainder
      }

      return {
        data: decoded,
        remainder: input.slice(length)
      }
    } else {
      llength = firstByte - 0xf6
      length = this._safeParseToInt(input.slice(1, llength).toString('hex'), 16)
      var totalLength = llength + length
      if (totalLength > input.length) {
        throw new Error('invalid rlp: total length is larger than the data')
      }

      innerRemainder = input.slice(llength, totalLength)
      if (innerRemainder.length === 0) {
        throw new Error('invalid rlp, List has a invalid length')
      }

      while (innerRemainder.length) {
        d = this._decode(innerRemainder)
        decoded.push(d.data)
        innerRemainder = d.remainder
      }
      return {
        data: decoded,
        remainder: input.slice(totalLength)
      }
    }
  }

  // 获取编码表示的长度
  _encodeLength(len, offset) {
    if (len < 56) {
      return Buffer.from([len + offset]);
    } else {
      let hexLength = this._intToHex(len);
      let halfHexLength = hexLength / 2;
      let firstByte = this._intToHex(offset + 55 + halfHexLength);
      return Buffer.from(firstByte, hexLength, 'hex');
    }
  }

  // 任意格式转化为buffer
  _toBuffer(v) {
    if (!Buffer.isBuffer(v)) {
      if (typeof v === 'string') {
        if (this._isHexPrefixed(v)) {
          v = Buffer.from(this._fixLengthToEven(this._removeHexPrefix(v)), 'hex');
        } else 
          v = Buffer.from(v)
      } else if (typeof v === 'number') {
        if (!v) {
          v = Buffer.from([]);
        } else 
          v = this._intToBuffer(v);
      } else if (v == null || v === undefined) {
        v = Buffer.from([]);
      } else if (v.toArray) {
        v = Buffer.from(v.toArray());
      } else {
        throw new Error('invalid type when convert to Buffer');
      }
    }
    return v;
  }

  // parseInt的加强，防止出错
  _safeParseToInt(v, base) {
    if (v.slice(0, 2) === '00')
      throw new Error('invalid RLP: extra zeros');
    return parseInt(v, base);
  }

  // 把前缀去掉，decode的时候需要
  _removeHexPrefix(str) {
    if (typeof str !== 'string')
      return str;

    return this._isHexPrefixed(str) ? str.slice(2) : str;
  }

  // int转化为Buffer，先转为16进制
  _intToBuffer(i) {
    let hex = this._intToHex(i);
    return Buffer.from(hex, 'hex');
  }

  // int转化为16进制
  _intToHex(i) {
    let hex = i.toString(16);
    return this._fixLengthToEven(hex);
  }

  // 长度补位为偶数
  _fixLengthToEven(str) {
    if (str.length % 2) 
      str = '0' + str;
    return str;
  }

  // 是否加上前缀过了
  _isHexPrefixed(str) {
    return str.slice(0, 2) === '0x';
  }
}

module.exports = RLP;